import unittest
from app.firewall import validate_target,rule_command
class Tests(unittest.TestCase):
 def test_service_rule_is_scoped_by_service_name(self):
  c=rule_command({"direction":"Outbound","service_name":"ExampleSvc"},"FGF-service")
  self.assertIn("-Service 'ExampleSvc'", c)
  self.assertIn("-Action Block", c)
  self.assertIn("-Direction Outbound", c)
 def test_unscoped(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound"})
 def test_bad_ip(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound","remote_ip":"bad"})
 def test_bad_port(self):
  with self.assertRaises(ValueError):validate_target({"direction":"Outbound","remote_port":99999})
 def test_exe(self):
  c=rule_command({"direction":"Outbound","program_path":r"C:\Apps\tool.exe"},"FGF-test")
  self.assertIn("-Program 'C:\\Apps\\tool.exe'",c)
if __name__=="__main__":unittest.main()
