"""Parceiros, campanhas, agenda, permissões e configurações, com fixtures isoladas."""
from pathlib import Path
import io, subprocess, time, unittest, urllib.request
from PIL import Image
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
def admin_login():
    credentials=dict(line.split(': ',1) for line in (ROOT/'api/storage/acesso-local.txt').read_text(encoding='utf-8').splitlines() if ': ' in line)
    status,data,_=request('/admin/login','POST',{'email':credentials['Email'],'password':credentials['Senha']})
    assert status==200,data
    return data['token']
def upload(route,fields,token,field='logo',content=None,mime='image/png'):
    boundary='promotion-test-boundary'
    if content is None:
        image=io.BytesIO();Image.new('RGB',(80,80),'#507662').save(image,'PNG');content=image.getvalue()
    parts=[f'--{boundary}\r\nContent-Disposition: form-data; name="{key}"\r\n\r\n{value}\r\n'.encode() for key,value in fields.items()]
    parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"; filename="test.png"\r\nContent-Type: {mime}\r\n\r\n'.encode()+content+b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return request(route,'POST',b''.join(parts),token,{'Content-Type':f'multipart/form-data; boundary={boundary}'})
class AdvertisingTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.admin=admin_login();cls.ids=[]
        _,cls.config,_=request('/admin/advertising',token=cls.admin)
        _,profile,_=request('/auth/register','POST',{'name':'Teste publicidade','email':f'adreview-{time.time_ns()}@example.invalid','password':'Advertising1234!'})
        cls.user=profile['token'];cls.uid=profile['user']['id']
    @classmethod
    def tearDownClass(cls):
        request('/admin/advertising','PUT',cls.config,cls.admin)
        subprocess.run(['php',str(ROOT/'scripts/cleanup-advertising-tests.php'),str(cls.uid),*map(str,cls.ids)],check=True,capture_output=True)
        request('/auth/logout','POST',token=cls.admin)
    def create_partner(self):
        code,p,_=upload('/admin/partners',{'name':'Teste publicidade API','description':'Marca de teste','website':'https://example.com','status':'1','order_position':'99'},self.admin)
        self.assertEqual(code,201,p);self.ids.append(p['id']);return p
    def test_access_validation_and_config(self):
        self.assertEqual(request('/admin/partners')[0],401)
        self.assertEqual(request('/admin/banners',token=self.user)[0],403)
        self.assertEqual(request('/admin/advertising','PUT',{},self.user)[0],403)
        self.assertEqual(request('/admin/partners','POST',{'name':'Invalid','website':'javascript:alert(1)'},self.admin)[0],422)
        self.assertEqual(upload('/admin/partners',{'name':'Invalid'},self.admin,content=b'<?php echo 1;?>')[0],422)
        self.assertEqual(request('/promotion-file?name=../config/local.php')[0],404)
        self.assertEqual(request('/admin/advertising','PUT',{**self.config,'admob_banner_id':'invalid'},self.admin)[0],422)
        self.assertEqual(request('/admin/advertising','PUT',{**self.config,'google_enabled':True,'test_mode':False,'admob_banner_id':''},self.admin)[0],422)
        self.assertEqual(request('/admin/advertising','PUT',{**self.config,'adsense_enabled':True,'adsense_client':''},self.admin)[0],422)
        self.assertEqual(request('/admin/advertising','PUT',{**self.config,'google_placements':['PLAYER']},self.admin)[0],422)
    def test_campaign_lifecycle_scheduling_and_premium(self):
        p=self.create_partner()
        with urllib.request.urlopen(p['logo_url']) as image:self.assertEqual(image.headers['Content-Type'],'image/webp');self.assertGreater(len(image.read()),20)
        request('/admin/advertising','PUT',{**self.config,'partners_enabled':True,'hide_for_premium':True},self.admin)
        data={'partner_id':p['id'],'title':'Teste publicidade campanha','description':'Mensagem de teste','url':'https://example.com','cta':'Conhecer','placements':['MEDIA','HOME','CONTENT','PARTNERS'],'status':1,'order_position':0}
        code,b,_=request('/admin/banners','POST',data,self.admin);self.assertEqual(code,201,b);bid=b['id']
        def public_ids(token=''):return [item['id'] for item in request('/advertising',token=token)[1]['banners']]
        self.assertIn(bid,public_ids());self.assertIn(bid,public_ids(self.user));self.assertNotIn(bid,public_ids(self.admin))
        for patch in [{'start_on':'2099-01-01'},{'start_on':'','end_on':'2000-01-01'},{'end_on':'','status':0}]:
            self.assertEqual(request(f'/admin/banners/{bid}','PUT',patch,self.admin)[0],200);self.assertNotIn(bid,public_ids())
        self.assertEqual(request(f'/admin/banners/{bid}','PUT',{'status':1},self.admin)[0],200);self.assertIn(bid,public_ids())
        for patch in [{'start_on':'2026-02-30'},{'start_on':'2026-10-08','end_on':'2026-10-07'},{'url':'http://example.com'},{'placements':[]},{'partner_id':999999}]:
            self.assertEqual(request(f'/admin/banners/{bid}','PUT',patch,self.admin)[0],422,patch)
        code,saved,_=upload(f'/admin/banners/{bid}',{'title':'Teste publicidade banner atualizado'},self.admin,'image');self.assertEqual(code,200,saved);self.assertTrue(saved['image_url'])
        request(f'/admin/partners/{p["id"]}','PUT',{'status':0},self.admin);self.assertNotIn(bid,public_ids())
        request(f'/admin/partners/{p["id"]}','PUT',{'status':1},self.admin);self.assertIn(bid,public_ids())
        request('/admin/advertising','PUT',{**self.config,'partners_enabled':False},self.admin);self.assertEqual(request('/advertising')[1]['partners'],[]);self.assertEqual(public_ids(),[])
        request('/admin/advertising','PUT',{**self.config,'partners_enabled':True,'hide_for_premium':False},self.admin);self.assertIn(bid,public_ids(self.admin))
        self.assertEqual(request(f'/admin/banners/{bid}','DELETE',token=self.admin)[0],200);self.assertNotIn(bid,public_ids())
        self.assertEqual(request(f'/admin/partners/{p["id"]}','DELETE',token=self.admin)[0],200)
        self.assertNotIn(p['id'],[x['id'] for x in request('/advertising')[1]['partners']])
        self.assertEqual(request(f'/admin/partners/{p["id"]}','PUT',{'status':1},self.admin)[0],404)
if __name__=='__main__':unittest.main(verbosity=2)
