"""Create one additional distribution identity, without revoking any existing identity.

The private identity is exported only in an authenticated encrypted envelope for the
operator's public key. Never print credentials or upload plaintext signing material.
"""
import base64, datetime, json, os, secrets, time, urllib.request, urllib.error
from pathlib import Path
import jwt
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.serialization import pkcs12

recipient = serialization.load_pem_public_key(os.environ['RECOVERY_PUBLIC_KEY'].encode())
if not isinstance(recipient, rsa.RSAPublicKey) or recipient.key_size < 3072:
    raise ValueError('A 3072-bit or larger RSA recovery public key is required')
token = jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': int(time.time()), 'exp': int(time.time()) + 600, 'aud': 'appstoreconnect-v1'}, base64.b64decode(os.environ['ASC_API_KEY_BASE64']), algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID']})

def api(method, path, payload=None):
    req = urllib.request.Request('https://api.appstoreconnect.apple.com/v1/' + path, method=method,
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
        data=json.dumps(payload).encode() if payload else None)
    try:
        with urllib.request.urlopen(req, timeout=40) as response:
            return json.load(response)['data']
    except urllib.error.HTTPError as error:
        detail = json.loads(error.read()).get('errors', [])
        raise RuntimeError(f'Apple API {method} {path}: {error.code}: {detail}') from None

bundle = api('GET', 'bundleIds?filter[identifier]=com.vxin.app')
if len(bundle) != 1:
    raise RuntimeError('Expected exactly one com.vxin.app bundle identifier')
key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
csr = x509.CertificateSigningRequestBuilder().subject_name(x509.Name([
    x509.NameAttribute(NameOID.COMMON_NAME, 'Vxin distribution signing'),
])).sign(key, hashes.SHA256())
certificate = api('POST', 'certificates', {'data': {'type': 'certificates', 'attributes': {
    'certificateType': 'IOS_DISTRIBUTION', 'csrContent': csr.public_bytes(serialization.Encoding.PEM).decode(),
}}})
cert = x509.load_der_x509_certificate(base64.b64decode(certificate['attributes']['certificateContent']))
password = secrets.token_urlsafe(32)
encryption = serialization.PrivateFormat.PKCS12.encryption_builder().kdf_rounds(50000).key_cert_algorithm(
    pkcs12.PBES.PBESv1SHA1And3KeyTripleDESCBC).hmac_hash(hashes.SHA1()).build(password.encode())
p12 = pkcs12.serialize_key_and_certificates(b'Vxin Distribution', key, cert, None, encryption)
payload = {'IOS_CERTIFICATE_P12_BASE64': base64.b64encode(p12).decode(), 'IOS_CERTIFICATE_PASSWORD': password}
output = Path(os.environ['RUNNER_TEMP']) / 'signing-recovery'
output.mkdir(mode=0o700, exist_ok=True)

def seal():
    symmetric = AESGCM.generate_key(bit_length=256)
    nonce = os.urandom(12)
    encrypted = AESGCM(symmetric).encrypt(nonce, json.dumps(payload).encode(), b'vxin-signing-recovery-v1')
    wrapped = recipient.encrypt(symmetric, padding.OAEP(mgf=padding.MGF1(hashes.SHA256()), algorithm=hashes.SHA256(), label=None))
    (output / 'encrypted.json').write_text(json.dumps({
        'key': base64.b64encode(wrapped).decode(), 'nonce': base64.b64encode(nonce).decode(),
        'ciphertext': base64.b64encode(encrypted).decode(), 'certificateId': certificate['id'],
    }))

# Retain the new identity securely even if profile creation is rejected.
seal()
profile_name = 'vxin_distribution_' + datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%d%H%M%S')
profile = api('POST', 'profiles', {'data': {'type': 'profiles', 'attributes': {
    'name': profile_name, 'profileType': 'IOS_APP_STORE',
}, 'relationships': {
    'bundleId': {'data': {'type': 'bundleIds', 'id': bundle[0]['id']}},
    'certificates': {'data': [{'type': 'certificates', 'id': certificate['id']}]},
}}})
payload['IOS_PROVISIONING_PROFILE_BASE64'] = profile['attributes']['profileContent']
seal()
print(json.dumps({'createdCertificate': certificate['id'], 'createdProfile': profile['id'],
    'profileName': profile_name, 'expires': certificate['attributes'].get('expirationDate'),
    'encryptedExport': str(output / 'encrypted.json')}))
