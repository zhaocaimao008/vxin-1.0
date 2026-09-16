"""Read-only signing diagnosis. Never log certificate private keys or API tokens."""
import base64, json, os, time, urllib.request, urllib.error
import jwt
from cryptography.hazmat.primitives.serialization import pkcs12

_, certificate, _ = pkcs12.load_key_and_certificates(
    base64.b64decode(os.environ['IOS_CERTIFICATE_P12_BASE64']),
    os.environ['IOS_CERTIFICATE_PASSWORD'].encode(),
)
serial = format(certificate.serial_number, 'X')
print(json.dumps({'certificateSerial': serial, 'validFrom': certificate.not_valid_before_utc.isoformat(), 'validUntil': certificate.not_valid_after_utc.isoformat()}))
token = jwt.encode({'iss': os.environ['ASC_ISSUER_ID'], 'iat': int(time.time()), 'exp': int(time.time()) + 300, 'aud': 'appstoreconnect-v1'}, base64.b64decode(os.environ['ASC_API_KEY_BASE64']), algorithm='ES256', headers={'kid': os.environ['ASC_KEY_ID']})
for resource in ['certificates?limit=200', 'bundleIds?filter[identifier]=com.vxin.app', 'apps?filter[bundleId]=com.vxin.app']:
    req = urllib.request.Request('https://api.appstoreconnect.apple.com/v1/' + resource, headers={'Authorization': 'Bearer ' + token})
    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.load(response)['data']
        print(json.dumps({'resource': resource, 'count': len(data), 'items': [{'id': item['id'], **{key: value for key, value in item['attributes'].items() if key in ['serialNumber', 'expirationDate', 'certificateType', 'identifier', 'name']}} for item in data]}))
    except urllib.error.HTTPError as error:
        print(json.dumps({'resource': resource, 'status': error.code, 'errors': json.loads(error.read()).get('errors')}))
