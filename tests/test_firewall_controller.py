import unittest
from core.firewall_controller import build_powershell_rule_command,validate_target
class FirewallTests(unittest.TestCase):
 def test_unscoped(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound","protocol":"Any"})
 def test_bad_ip(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound","remote_ip":"not-an-ip"})
 def test_bad_port(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound","remote_port":99999})
 def test_program(self):
  x=build_powershell_rule_command({"direction":"Outbound","protocol":"Any","program_path":r"C:\Apps\tool.exe"},"WFGPro-test")
  self.assertIn("-Program 'C:\\Apps\\tool.exe'",x)
 def test_service(self):
  x=build_powershell_rule_command({"direction":"Outbound","protocol":"Any","service_name":"UpdateSvc"},"WFGPro-test")
  self.assertIn("-Service 'UpdateSvc'",x)
if __name__=="__main__":unittest.main()
