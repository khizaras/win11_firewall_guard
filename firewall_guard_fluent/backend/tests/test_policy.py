import unittest
from app.policy import wildcard_match,validate_policy,matches
class Tests(unittest.TestCase):
 def test_star(self):self.assertTrue(wildcard_match("Chrome.EXE",["chrome*"]))
 def test_question(self):self.assertTrue(wildcard_match("python3.exe",["python?.exe"]))
 def test_no_selector(self):self.assertTrue(validate_policy({"id":"x"}))
 def test_match(self):
  p={"id":"x","enabled":True,"automatic":True,"action":"block","direction":"outbound","process_name_patterns":["*updater*"],"protocol":"Any"}
  self.assertTrue(matches(p,{"direction":"outbound","process":"Updater.exe","protocol":"TCP"}))
 def test_disabled(self):
  self.assertFalse(matches({"id":"x","enabled":False,"automatic":True,"process_name_patterns":["*"]},{"process":"x"}))
if __name__=="__main__":unittest.main()
