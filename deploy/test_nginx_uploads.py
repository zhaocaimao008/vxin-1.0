import importlib.util
from pathlib import Path
import unittest

spec = importlib.util.spec_from_file_location('uploads', Path(__file__).with_name('configure-nginx-uploads.py'))
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

FIXTURE = '''events {}
http {
server {
    listen 80;
    server_name vxinchat.com www.vxinchat.com;
    location /uploads/ {
        alias /var/www/vxin-uploads/;
        expires 30d;
    }
    location /app/ { root /var/www/vxin-web; }
}
server {
    listen 81;
    server_name another.example;
    location /uploads/ { alias /srv/other-uploads/; }
}
}
'''


class MediaRouting(unittest.TestCase):
    def test_only_target_location_changes(self):
        updated = module.updated_config(FIXTURE)
        self.assertIn('location ^~ /uploads/', updated)
        self.assertIn('proxy_pass http://127.0.0.1:3002;', updated)
        self.assertNotIn('expires 30d', updated)
        self.assertIn('location /uploads/ { alias /srv/other-uploads/; }', updated)
        self.assertIn('location /app/ { root /var/www/vxin-web; }', updated)
        self.assertEqual(updated.count('server_name'), 2)

    def test_repeat_is_idempotent(self):
        updated = module.updated_config(FIXTURE)
        self.assertEqual(module.updated_config(updated), updated)

    def test_unexpected_configuration_is_rejected(self):
        with self.assertRaises(ValueError):
            module.updated_config(FIXTURE.replace('www.vxinchat.com', 'other.example'))
        with self.assertRaises(ValueError):
            module.updated_config(FIXTURE + FIXTURE)


if __name__ == '__main__':
    unittest.main()
