import unittest
from core.policy_engine import wildcard_match,policy_matches,validate_policy,policy_target
class PolicyTests(unittest.TestCase):
 def setUp(self):
  self.c={"direction":"outbound","protocol":"TCP","remote_ip":"203.0.113.10","remote_port":443,"program_path":r"C:\Apps\Updater.exe","process":"Updater.exe","services":["UpdateSvc"]}
  self.p={"id":"test","enabled":True,"automatic":True,"action":"block","direction":"outbound","process_name_patterns":["*updater*"],"service_name_patterns":["Update*"],"remote_ips":["203.0.113.0/24"],"remote_ports":[443],"program_paths":[],"protocol":"TCP"}
 def test_star(self):self.assertTrue(wildcard_match("Chrome.EXE",["chrome*"]))
 def test_question(self):self.assertTrue(wildcard_match("python3.exe",["python?.exe"]))
 def test_match(self):self.assertTrue(policy_matches(self.p,self.c))
 def test_disabled(self):self.p["enabled"]=False;self.assertFalse(policy_matches(self.p,self.c))
 def test_not_automatic(self):self.p["automatic"]=False;self.assertFalse(policy_matches(self.p,self.c))
 def test_process_mismatch(self):self.p["process_name_patterns"]=["chrome*"];self.assertFalse(policy_matches(self.p,self.c))
 def test_no_selector(self):
  self.p.update(process_name_patterns=[],service_name_patterns=[],remote_ips=[],remote_ports=[],program_paths=[])
  self.assertTrue(validate_policy(self.p))
 def test_target(self):self.assertEqual(policy_target(self.p,self.c)["remote_ip"],"203.0.113.10")
if __name__=="__main__":unittest.main()
