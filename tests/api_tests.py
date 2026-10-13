"""Testes reais da API local. Fixtures são removidas ao terminar."""
import io
import json
from pathlib import Path
import subprocess
import time
import unittest
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image

ROOT=Path(__file__).resolve().parent.parent
API='http://localhost/app_mamografia/api/index.php'
def request(route,method='GET',data=None,token='',headers=None):
    path,_,params=route.partition('?')
    url=API+'?route='+urllib.parse.quote(path,safe='/')+('&'+params if params else '')
    extra={'Authorization':'Bearer '+token} if token else {}
    if data is not None and not isinstance(data,bytes):
        data=json.dumps(data).encode();extra['Content-Type']='application/json'
    extra.update(headers or {})
    try:
        with urllib.request.urlopen(urllib.request.Request(url,data=data,method=method,headers=extra),timeout=20) as response:
            body=response.read();return response.status,json.loads(body),dict(response.headers)
    except urllib.error.HTTPError as e:
        body=e.read()
        try:body=json.loads(body)
        except ValueError:pass
        return e.code,body,dict(e.headers)

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        access=(ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8')
        credentials={line.split(': ',1)[0]:line.split(': ',1)[1] for line in access.splitlines() if ': ' in line}
        status,result,_=request('/admin/login','POST',{'email':credentials['Email'],'password':credentials['Senha']})
        assert status==200,result
        cls.admin=result['token'];cls.fixture_media=[]
        cls.email=f'integration-{time.time_ns()}@example.invalid'
        status,result,_=request('/auth/register','POST',{'name':'Teste automatizado','email':cls.email,'password':'Integration1234!'})
        assert status==200,result
        cls.user=result['token'];cls.user_id=result['user']['id']
    @classmethod
    def tearDownClass(cls):
        subprocess.run(['php',str(ROOT/'scripts/cleanup-tests.php'),str(cls.user_id),*map(str,cls.fixture_media)],check=True,capture_output=True)
        request('/auth/logout','POST',token=cls.admin)

    def test_catalog_and_filters(self):
        status,stats,_=request('/stats');self.assertEqual(status,200)
        self.assertGreaterEqual(int(stats['images']),62);self.assertGreaterEqual(int(stats['videos']),15)
        _,videos,_=request('/media?type=VIDEO&limit=100');self.assertTrue(all(v['type']!='IMAGE' for v in videos['data']))
        _,images,_=request('/media?type=IMAGE&q=Craniocaudal&category_id=2&limit=100')
        self.assertEqual(images['total'],8)
        _,page,_=request('/media?limit=5&page=2');self.assertEqual(len(page['data']),5);self.assertEqual(page['page'],2)

    def test_effective_access_filter(self):
        # Both catalog statements (count and rows) must accept the access filter.
        # FREE includes unlocked images/videos; PREMIUM follows parent access.
        status,free,_=request('/media?type=VIDEO&access=FREE&limit=1')
        self.assertEqual(status,200,free);self.assertGreater(free['total'],0)
        self.assertEqual(len(free['data']),1);self.assertEqual(free['data'][0]['access_type'],'FREE')
        self.assertFalse(free['data'][0]['locked'])
        for access in ['FREE','PREMIUM']:
            status,result,_=request(f'/media?access={access}&limit=100')
            self.assertEqual(status,200,result)
            self.assertTrue(all(item['access_type']==access for item in result['data']))
        status,excluded,_=request('/media?category_id=3&access=FREE&limit=1')
        self.assertEqual(status,200,excluded);self.assertEqual(excluded['total'],0)
        status,review,_=request('/admin/media?access=PREMIUM&limit=1',token=self.admin)
        self.assertEqual(status,200,review);self.assertEqual(review['data'][0]['access_type'],'PREMIUM')

    def test_access_control_and_file_ranges(self):
        _,locked,_=request('/media?category_id=3&limit=1');item=locked['data'][0]
        self.assertTrue(item['locked']);self.assertIsNone(item['url']);self.assertIsNone(item['thumbnail_url'])
        self.assertEqual(request('/contents/3')[0],403)
        self.assertEqual(request('/admin/media')[0],401)
        self.assertEqual(request('/admin/media',token=self.user)[0],403)
        _,review,_=request('/admin/media?category_id=3&limit=1',token=self.admin)
        self.assertFalse(review['data'][0]['locked']);self.assertTrue(review['data'][0]['url'])
        _,free,_=request('/media?type=VIDEO&access=FREE&limit=1');url=free['data'][0]['url']
        with urllib.request.urlopen(urllib.request.Request(url,headers={'Range':'bytes=0-1023'})) as r:
            self.assertEqual(r.status,206);self.assertEqual(len(r.read()),1024);self.assertTrue(r.headers['Content-Range'].startswith('bytes 0-1023/'))
        for target in [url.replace('sig=','sig=invalid'),url.replace('/files/9','/files/999999'),url.replace('expires=','expires=1')]:
            try:urllib.request.urlopen(target);self.fail('Assinatura inválida aceita.')
            except urllib.error.HTTPError as e:self.assertIn(e.code,[403,404])
        for path in ['api/config/local.php','api/storage/acesso-local.txt','database/materials.json','uploads/images/anything.jpg','docs/manual-extraido.txt','scripts/setup.php']:
            try:urllib.request.urlopen('http://localhost/app_mamografia/'+path);self.fail('Arquivo privado exposto: '+path)
            except urllib.error.HTTPError as e:self.assertEqual(e.code,403)

    def test_favorites_and_logout(self):
        _,page,_=request('/media?access=FREE&limit=1');mid=page['data'][0]['id']
        self.assertEqual(request(f'/favorites/{mid}','POST',token=self.user)[0],200)
        request(f'/favorites/{mid}','POST',token=self.user)
        _,favorites,_=request('/favorites/ids',token=self.user);self.assertEqual(favorites.count(mid),1)
        self.assertEqual(request('/favorites',token=self.user)[1]['total'],1)
        request(f'/favorites/{mid}','DELETE',token=self.user)
        self.assertEqual(request('/favorites/ids',token=self.user)[1],[])
        _,login,_=request('/auth/login','POST',{'email':self.email,'password':'Integration1234!'})
        self.assertEqual(request('/auth/logout','POST',token=login['token'])[0],200)
        self.assertEqual(request('/profile',token=login['token'])[0],401)

    def upload(self,content,mime='image/png',name='integration-test.png'):
        boundary='mamografia-integration-boundary'
        fields={'title':'Teste de integração','topic_id':'1','access_type':'FREE','status':'1','order_position':'99'}
        parts=[]
        for k,v in fields.items():parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="{name}"\r\nContent-Type: {mime}\r\n\r\n'.encode()+content+b'\r\n')
        parts.append(f'--{boundary}--\r\n'.encode())
        return request('/admin/media','POST',b''.join(parts),self.admin,{'Content-Type':f'multipart/form-data; boundary={boundary}'})

    def test_upload_edit_deactivate_archive(self):
        image=io.BytesIO();Image.new('RGB',(20,20),'white').save(image,format='PNG')
        status,item,_=self.upload(image.getvalue());self.assertEqual(status,201,item)
        self.fixture_media.append(item['id']);self.assertEqual(item['type'],'IMAGE');self.assertTrue(item['thumbnail_url'])
        data={'title':'Teste de integração atualizado','topic_id':1,'caption':'Legenda de teste','alt_text':'Texto de teste','access_type':'FREE','status':1,'order_position':100}
        status,updated,_=request(f'/admin/media/{item["id"]}','PUT',data,self.admin)
        self.assertEqual(status,200);self.assertEqual(updated['caption'],data['caption'])
        data['status']=0;request(f'/admin/media/{item["id"]}','PUT',data,self.admin)
        self.assertEqual(request(f'/media/{item["id"]}')[0],404)
        self.assertEqual(request(f'/admin/media/{item["id"]}','DELETE',token=self.admin)[0],200)
        self.assertEqual(request(f'/media/{item["id"]}')[0],404)
        self.assertEqual(self.upload(b'<?php echo "bad";',mime='image/png')[0],422)
        self.assertEqual(request('/admin/media','POST',{'type':'VIDEO_URL','title':'Teste','external_url':'javascript:alert(1)'},self.admin)[0],422)

if __name__=='__main__':unittest.main(verbosity=2)
