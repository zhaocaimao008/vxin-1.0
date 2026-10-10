#!/usr/bin/env python3
"""Private, verified SQLite/media snapshots and non-destructive recovery drills."""
import argparse, datetime as dt, fcntl, hashlib, json, os, shutil, sqlite3, tarfile, tempfile, time
from pathlib import Path
from urllib.request import urlopen
from urllib.error import HTTPError

os.umask(0o077)
def now(): return dt.datetime.now(dt.timezone.utc).isoformat()
def sha(p):
    h=hashlib.sha256()
    with open(p,'rb') as f:
        for b in iter(lambda:f.read(1024*1024),b''): h.update(b)
    return h.hexdigest()
def write_json(path,data):
    path=Path(path); tmp=path.with_name(path.name+'.tmp')
    tmp.write_text(json.dumps(data,ensure_ascii=False,indent=2));os.replace(tmp,path)
def database_summary(path):
    with sqlite3.connect('file:'+str(path)+'?mode=ro',uri=True) as db:
        check=[r[0] for r in db.execute('PRAGMA integrity_check')]
        if check!=['ok']: raise RuntimeError('SQLite integrity check failed')
        counts={t:db.execute('SELECT COUNT(*) FROM '+t).fetchone()[0] for t in ['users','messages','conversations','conversation_members']}
        return {'integrity':'ok','counts':counts,'foreignKeyViolations':len(db.execute('PRAGMA foreign_key_check').fetchall())}
def backup(c):
    root=Path(c['backup_dir']).resolve();root.mkdir(parents=True,exist_ok=True,mode=0o700)
    name=dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    stage=Path(tempfile.mkdtemp(prefix='.pending-',dir=root));final=root/name
    try:
        with sqlite3.connect('file:'+c['db']+'?mode=ro',uri=True,timeout=30) as source,sqlite3.connect(stage/'database.sqlite') as target:
            source.backup(target,pages=256,sleep=0.1)
        stats=database_summary(stage/'database.sqlite')
        uploads=Path(c['uploads']).resolve();files={}
        with tarfile.open(stage/'uploads.tar.gz','w:gz') as tar:
            for p in sorted(uploads.rglob('*')):
                if p.is_symlink(): raise RuntimeError('Refusing symlink in uploads')
                if p.is_file():
                    rel=str(p.relative_to(uploads));digest=sha(p)
                    tar.add(p,arcname=rel,recursive=False)
                    if sha(p)!=digest: raise RuntimeError('Media changed during backup; retry')
                    files[rel]={'sha256':digest,'bytes':p.stat().st_size}
        configs=stage/'config';configs.mkdir()
        for index,source in enumerate(c.get('config_files',[])):
            shutil.copyfile(source,configs/(str(index)+'-'+Path(source).name))
        artifacts={str(p.relative_to(stage)):sha(p) for p in stage.rglob('*') if p.is_file()}
        manifest={'createdAt':now(),'database':stats,'uploads':files,'artifacts':artifacts}
        write_json(stage/'manifest.json',manifest)
        # Verify the archive and DB before making this snapshot visible to retention/monitoring.
        drill(c,stage,temporary=True)
        os.replace(stage,final)
        write_json(root/'latest.json',{'snapshot':name,'createdAt':manifest['createdAt'],'files':len(files),'database':stats})
        # Only our strictly named, verified snapshots are eligible; keep a minimum of two.
        snapshots=sorted(p for p in root.iterdir() if p.is_dir() and len(p.name)==16 and p.name.endswith('Z') and (p/'manifest.json').is_file())
        for old in snapshots[:-2]:
            if time.time()-old.stat().st_mtime>c.get('keep_days',30)*86400:
                if old.resolve().parent!=root: raise RuntimeError('Retention escaped backup root')
                shutil.rmtree(old)
        return {'ok':True,'snapshot':name,'uploads':len(files),'database':stats}
    finally:
        if stage.exists(): shutil.rmtree(stage)
def drill(c,snapshot=None,temporary=False):
    root=Path(c['backup_dir']).resolve()
    if snapshot is None: snapshot=root/json.loads((root/'latest.json').read_text())['snapshot']
    snapshot=Path(snapshot).resolve();manifest=json.loads((snapshot/'manifest.json').read_text())
    for relative,digest in manifest['artifacts'].items():
        p=(snapshot/relative).resolve()
        if not p.is_relative_to(snapshot) or sha(p)!=digest: raise RuntimeError('Snapshot checksum mismatch')
    drillroot=Path(c['state_dir'])/'restore-drills';drillroot.mkdir(parents=True,exist_ok=True)
    dest=Path(tempfile.mkdtemp(prefix='drill-',dir=drillroot))
    try:
        shutil.copyfile(snapshot/'database.sqlite',dest/'database.sqlite')
        media=dest/'uploads';media.mkdir()
        with tarfile.open(snapshot/'uploads.tar.gz','r:gz') as tar:
            for member in tar.getmembers():
                p=(media/member.name).resolve()
                if not p.is_relative_to(media) or not member.isfile(): raise RuntimeError('Unsafe media archive member')
                p.parent.mkdir(parents=True,exist_ok=True)
                with tar.extractfile(member) as src,p.open('wb') as dst: shutil.copyfileobj(src,dst)
        found={str(p.relative_to(media)):sha(p) for p in media.rglob('*') if p.is_file()}
        expected={k:v['sha256'] for k,v in manifest['uploads'].items()}
        if found!=expected: raise RuntimeError('Restored media differs from manifest')
        stats=database_summary(dest/'database.sqlite')
        if stats!=manifest['database']: raise RuntimeError('Restored database differs from manifest')
        result={'ok':True,'checkedAt':now(),'database':stats,'mediaFilesVerified':len(found),'productionModified':False}
        if not temporary: write_json(Path(c['state_dir'])/'restore-result.json',result)
        return result
    finally:
        # Drill data never becomes a running service or overwrites production.
        if dest.resolve().parent!=drillroot.resolve(): raise RuntimeError('Invalid drill directory')
        shutil.rmtree(dest)
def monitor(c):
    state=Path(c['state_dir']);state.mkdir(parents=True,exist_ok=True)
    checks={}
    for name,url in [('database_health',c['local_url']+'/health'),('public_api',c['public_url']+'/api/config'),('web_entry',c['public_url']+'/app/login')]:
        try:
            with urlopen(url,timeout=15) as r:
                body=r.read(1024*1024)
                checks[name]=(r.status==200 and (json.loads(body).get('db')=='ok' if name=='database_health' else bool(json.loads(body).get('features')) if name=='public_api' else b'<html' in body.lower()))
        except Exception: checks[name]=False
    try:
        urlopen(c['public_url']+'/uploads/monitor-nonexistent',timeout=15);checks['private_media_gate']=False
    except HTTPError as e: checks['private_media_gate']=e.code==401
    except Exception: checks['private_media_gate']=False
    try:
        latest=json.loads((Path(c['backup_dir'])/'latest.json').read_text())
        checks['recent_verified_backup']=(dt.datetime.now(dt.timezone.utc)-dt.datetime.fromisoformat(latest['createdAt'])).total_seconds()<30*3600
    except Exception: checks['recent_verified_backup']=False
    usage=shutil.disk_usage(c['backup_dir']);checks['disk_space']=usage.used/usage.total<.85
    # Only aggregate new diagnostics; never copy message bodies, tokens, or IPs into alerts.
    cursorfile=state/'log-cursor.json';cursor=json.loads(cursorfile.read_text()) if cursorfile.exists() else {}
    log=Path(c['backend_log']);counts={'clientErrors':0,'serverErrors':0}
    if log.exists():
        stat=log.stat();offset=cursor.get('offset',0) if cursor.get('inode')==stat.st_ino else 0
        if offset>stat.st_size: offset=0
        # First install starts at the current end; old incidents are not new alerts.
        if not cursorfile.exists(): offset=stat.st_size
        with log.open('rb') as f:
            f.seek(offset)
            for raw in f:
                try: row=json.loads(raw)
                except Exception: continue
                counts['clientErrors']+=int('[client-error]' in row.get('message',''))
                counts['serverErrors']+=int(row.get('level')=='error')
            write_json(cursorfile,{'inode':stat.st_ino,'offset':f.tell()})
    checks['client_error_rate']=counts['clientErrors']<5;checks['server_error_rate']=counts['serverErrors']<5
    failed=sorted(k for k,v in checks.items() if not v)
    result={'checkedAt':now(),'ok':not failed,'checks':checks,'diagnostics':counts,'notificationChannel':'local-journal','failed':failed}
    path=state/'status.json';previous=json.loads(path.read_text()) if path.exists() else {}
    write_json(path,result)
    if previous.get('failed')!=failed:
        event={'time':now(),'state':'degraded' if failed else 'healthy','failed':failed}
        events=state/'events.jsonl'
        if events.exists() and events.stat().st_size>1024*1024:os.replace(events,state/'events.previous.jsonl')
        with events.open('a') as f:f.write(json.dumps(event)+'\n')
        print(json.dumps(event))
    return result
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('action',choices=['backup','restore-drill','monitor']);p.add_argument('--config',required=True);args=p.parse_args()
    c=json.loads(Path(args.config).read_text());Path(c['state_dir']).mkdir(parents=True,exist_ok=True)
    with open(Path(c['state_dir'])/(args.action+'.lock'),'w') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        result={'backup':backup,'restore-drill':drill,'monitor':monitor}[args.action](c)
    if args.action!='monitor':print(json.dumps(result))
    raise SystemExit(0 if result['ok'] else 1)
