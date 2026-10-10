import importlib.util,json,sqlite3,tempfile,unittest,tarfile,io
from unittest.mock import patch
from pathlib import Path
spec=importlib.util.spec_from_file_location('ops',str(Path(__file__).with_name('vxin-ops.py')));ops=importlib.util.module_from_spec(spec);spec.loader.exec_module(ops)
class BackupTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
        self.c={k:str(self.root/v) for k,v in {'backup_dir':'backups','state_dir':'state','db':'live.sqlite','uploads':'uploads'}.items()}
        Path(self.c['state_dir']).mkdir();Path(self.c['uploads']).mkdir();(Path(self.c['uploads'])/'sample.txt').write_text('synthetic fixture')
        with sqlite3.connect(self.c['db']) as db:
            for t in ['users','messages','conversations','conversation_members']:db.execute('CREATE TABLE '+t+' (id TEXT)');db.execute('INSERT INTO '+t+" VALUES ('fixture')")
    def tearDown(self):self.temp.cleanup()
    def snapshot(self):return Path(self.c['backup_dir'])/json.loads((Path(self.c['backup_dir'])/'latest.json').read_text())['snapshot']
    def test_wal_snapshot_restore_and_no_live_changes(self):
        with sqlite3.connect(self.c['db']) as live:
            live.execute('PRAGMA journal_mode=WAL');live.execute("INSERT INTO messages VALUES ('wal-only')");live.commit()
            before=ops.database_summary(self.c['db']);ops.backup(self.c);r=ops.drill(self.c)
            self.assertEqual(r['database'],before);self.assertEqual(ops.database_summary(self.c['db']),before)
            self.assertEqual(r['mediaFilesVerified'],1)
    def test_corrupt_backup_is_rejected(self):
        ops.backup(self.c);(self.snapshot()/'database.sqlite').write_bytes(b'broken')
        with self.assertRaisesRegex(RuntimeError,'checksum'):ops.drill(self.c)
    def test_archive_escape_is_rejected(self):
        ops.backup(self.c);p=self.snapshot();archive=p/'uploads.tar.gz'
        with tarfile.open(archive,'w:gz') as tar:
            entry=tarfile.TarInfo('../escape');entry.size=4;tar.addfile(entry,io.BytesIO(b'test'))
        m=json.loads((p/'manifest.json').read_text());m['artifacts']['uploads.tar.gz']=ops.sha(archive);ops.write_json(p/'manifest.json',m)
        with self.assertRaisesRegex(RuntimeError,'Unsafe'):ops.drill(self.c)
        self.assertFalse((Path(self.c['state_dir'])/'restore-drills'/'escape').exists())
    def test_monitor_records_one_failure_transition_and_one_recovery(self):
        from urllib.error import HTTPError
        ops.backup(self.c)
        self.c.update(local_url='http://fixture',public_url='https://fixture',backend_log=str(self.root/'combined.log'))
        broken=[False]
        class Response(io.BytesIO):status=200
        def response(url,**kwargs):
            if '/uploads/' in url:raise HTTPError(url,401,'Unauthorized',{},None)
            if url.endswith('/health'):return Response(b'{"db":"ok"}')
            if url.endswith('/api/config'):return Response(b'{}' if broken[0] else b'{"features":{"chat":true}}')
            return Response(b'<html>fixture</html>')
        with patch.object(ops,'urlopen',side_effect=response):
            self.assertTrue(ops.monitor(self.c)['ok']);broken[0]=True
            self.assertFalse(ops.monitor(self.c)['ok']);self.assertFalse(ops.monitor(self.c)['ok'])
            broken[0]=False;self.assertTrue(ops.monitor(self.c)['ok'])
        rows=[json.loads(x) for x in (Path(self.c['state_dir'])/'events.jsonl').read_text().splitlines()]
        self.assertEqual([x['state'] for x in rows],['healthy','degraded','healthy'])
if __name__=='__main__':unittest.main()
