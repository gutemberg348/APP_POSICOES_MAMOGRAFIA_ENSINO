"""Verifica gestão, autorização, sessões e métricas sem alterar contas reais."""
from pathlib import Path
import subprocess, time, unittest, uuid
from api_tests import request

ROOT=Path(__file__).resolve().parent.parent
HELPER=ROOT/'scripts/management-test-fixtures.php'

class ManagementTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        stamp=str(time.time_ns());cls.email=f'management-{stamp}@example.invalid'
        cls.admin_email=f'management-admin-{stamp}@example.invalid';cls.events=[]
        subprocess.run(['php',str(HELPER),'admin',cls.admin_email],check=True,capture_output=True)
        subprocess.run(['php',str(HELPER),'login-window',cls.admin_email],check=True,capture_output=True)
        status,result,_=request('/admin/login','POST',{'email':cls.admin_email,'password':'ManagementTest123!'})
        assert status==200,result;cls.admin=result['token']
        status,client,_=request('/admin/users','POST',{'name':'Teste gestão','email':cls.email,'password':'ClientTest123!','is_premium':0},cls.admin)
        assert status==201,client;cls.uid=client['id']
        status,result,_=request('/auth/login','POST',{'email':cls.email,'password':'ClientTest123!'})
        assert status==200,result;cls.client=result['token']
        cls.identity={'name':'Teste gestão','email':cls.email,'is_premium':0,'status':1}
        _,cls.settings,_=request('/admin/settings',token=cls.admin)

    @classmethod
    def tearDownClass(cls):
        request('/admin/settings','PUT',cls.settings,cls.admin)
        for email in [cls.email,cls.admin_email]:subprocess.run(['php',str(HELPER),'cleanup',email],check=True,capture_output=True)
        subprocess.run(['php',str(HELPER),'analytics',cls.email,*cls.events],check=True,capture_output=True)

    def test_01_permissions_and_catalog(self):
        for route in ['/admin/users','/admin/dashboard','/admin/settings','/admin/account',f'/admin/users/{self.uid}']:
            self.assertEqual(request(route)[0],401)
            self.assertEqual(request(route,token=self.client)[0],403)
        status,result,_=request(f'/admin/users?q={self.email}',token=self.admin)
        self.assertEqual(status,200);self.assertEqual(result['total'],1);self.assertNotIn('password_hash',result['data'][0])
        for data,expected in [({**self.identity,'password':'short'},422),({**self.identity,'password':'ClientTest123!'},409)]:
            self.assertEqual(request('/admin/users','POST',data,self.admin)[0],expected)
        status,detail,_=request(f'/admin/users/{self.uid}',token=self.admin)
        self.assertEqual(status,200);self.assertNotIn('password_hash',detail);self.assertTrue(detail['history']);self.assertEqual(detail['sessions_count'],1)

    def test_02_premium_block_and_password(self):
        route=f'/admin/users/{self.uid}'
        status,result,_=request(route,'PUT',{**self.identity,'is_premium':1},self.admin)
        self.assertEqual(status,200,result);self.assertEqual(result['is_premium'],1);self.assertTrue(result['premium_since'])
        status,media,_=request('/media?category_id=3&limit=1',token=self.client)
        self.assertEqual(status,200);self.assertFalse(media['data'][0]['locked']);self.assertTrue(media['data'][0]['url'])
        self.assertEqual(request(route,'PUT',self.identity,self.admin)[0],200)
        self.assertTrue(request('/media?category_id=3&limit=1',token=self.client)[1]['data'][0]['locked'])
        self.assertEqual(request(route,'PUT',{**self.identity,'status':0},self.admin)[0],200)
        self.assertEqual(request('/profile',token=self.client)[0],401)
        self.assertEqual(request('/auth/login','POST',{'email':self.email,'password':'ClientTest123!'})[0],401)
        self.assertEqual(request(route,'PUT',self.identity,self.admin)[0],200)
        _,login,_=request('/auth/login','POST',{'email':self.email,'password':'ClientTest123!'})
        self.assertEqual(request(route+'/password','PUT',{'password':'bad'},self.admin)[0],422)
        self.assertEqual(request(route+'/password','PUT',{'password':'ChangedClient123!'},self.admin)[0],200)
        self.assertEqual(request('/profile',token=login['token'])[0],401)
        self.assertEqual(request('/auth/login','POST',{'email':self.email,'password':'ClientTest123!'})[0],401)
        self.assertEqual(request('/auth/login','POST',{'email':self.email,'password':'ChangedClient123!'})[0],200)
        history=request(route,token=self.admin)[1]['history']
        for action in ['PREMIUM_GRANTED','PREMIUM_REVOKED','CLIENT_BLOCKED','CLIENT_PASSWORD_CHANGED']:
            self.assertIn(action,[h['action'] for h in history])

    def test_03_settings_and_admin_password(self):
        self.assertEqual(request('/admin/settings','PUT',{**self.settings,'support_email':'invalid'},self.admin)[0],422)
        self.assertEqual(request('/admin/settings','PUT',{**self.settings,'privacy_url':'javascript:alert(1)'},self.admin)[0],422)
        self.assertEqual(request('/admin/settings','PUT',{**self.settings,'analytics_enabled':'1'},self.admin)[0],200)
        _,public,_=request('/settings');self.assertNotIn('advertising_config',public)
        _,second,_=request('/admin/login','POST',{'email':self.admin_email,'password':'ManagementTest123!'})
        identity={'name':'Teste gestão','email':self.admin_email,'password':'ChangedAdmin123!'}
        status,account,_=request('/admin/account','PUT',identity,self.admin)
        self.assertEqual(status,200,account);self.assertNotIn('password_hash',account)
        self.assertEqual(request('/profile',token=self.admin)[0],200)
        self.assertEqual(request('/profile',token=second['token'])[0],401)
        self.assertEqual(request(f"/admin/users/{account['id']}/password",'PUT',{'password':'Forbidden123!'},self.admin)[0],403)
        self.assertEqual(request('/admin/login','POST',{'email':self.admin_email,'password':'ChangedAdmin123!'})[0],200)

    def test_04_real_metrics_and_deduplication(self):
        visitor=str(uuid.uuid4());event=str(uuid.uuid4());self.events.append(event)
        payload={'visitor':visitor,'event_id':event,'screen':'home','device':'desktop'}
        _,before,_=request('/admin/dashboard?days=7',token=self.admin)
        for _ in range(2):
            status,result,_=request('/analytics/visit','POST',payload)
            self.assertEqual(status,202,result);self.assertTrue(result['collected'])
        _,after,_=request('/admin/dashboard?days=7',token=self.admin)
        self.assertEqual(int(after['traffic']['views']),int(before['traffic']['views'])+1)
        self.assertEqual(int(after['traffic']['visitors']),int(before['traffic']['visitors'])+1)
        self.assertEqual(request('/analytics/visit','POST',{**payload,'screen':'invalid'})[0],422)
        self.assertFalse(request('/analytics/visit','POST',payload,self.admin)[1]['collected'])
        request('/admin/settings','PUT',{**self.settings,'analytics_enabled':'0'},self.admin)
        self.assertFalse(request('/analytics/visit','POST',payload)[1]['collected'])

if __name__=='__main__':unittest.main(verbosity=2)
