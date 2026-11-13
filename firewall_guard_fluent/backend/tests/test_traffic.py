import json, os, sys, tempfile, unittest
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.store import Store
from app.traffic import pattern_candidates
from app.firewall import rule_command, build_batch_add_script, build_batch_remove_script
from app import broker


class StorePatterns(unittest.TestCase):
 def setUp(self):
  self.db = Store(Path(tempfile.mkdtemp()) / "t.db")
 def test_roundtrip(self):
  p = self.db.add_pattern("*microsoft.com*")
  self.assertTrue(p["id"] >= 1)
  self.assertEqual([x["pattern"] for x in self.db.domain_patterns()], ["*microsoft.com*"])
  self.db.set_pattern_enabled(p["id"], False)
  self.assertFalse(self.db.domain_patterns()[0]["enabled"])
  self.db.delete_pattern(p["id"])
  self.assertEqual(self.db.domain_patterns(), [])
 def test_unique(self):
  self.db.add_pattern("a.com")
  self.db.add_pattern("a.com")
  self.assertEqual(len(self.db.domain_patterns()), 1)


class PatternCandidates(unittest.TestCase):
 def test_wild(self):
  self.assertEqual(pattern_candidates("*microsoft.com*"), ["microsoft.com"])
  self.assertIn("microsoft.com", pattern_candidates("*.microsoft.com"))
 def test_bad(self):
  self.assertEqual(pattern_candidates("*"), [])
  self.assertEqual(pattern_candidates(""), [])
 def test_simple(self):
  self.assertEqual(pattern_candidates("example.com"), ["example.com"])


class BatchScripts(unittest.TestCase):
 def test_add_script_contains_rule(self):
  t = {"direction": "Outbound", "protocol": "ANY", "remote_ip": "51.10.0.5"}
  valid = [("FGF-dom-x-ip1", t)]
  script = build_batch_add_script(valid, "C:\\temp\\out.json")
  self.assertIn("51.10.0.5", script)
  self.assertIn("'FGF-dom-x-ip1'", script)
 def test_remove_script_quotes(self):
  script = build_batch_remove_script(["FGF-dom-x-ip1"], "C:\\out.json")
  self.assertIn("Remove-NetFirewallRule", script)


class BrokerQueue(unittest.TestCase):
 def test_command_timeout_without_ack(self):
  broker.ensure_dirs()
  res = broker.write_command("noop", {"x": 1}, timeout=0.6)
  self.assertEqual(res["status"], "timeout")
 def test_alive_false(self):
  alive, info = broker.broker_alive()
  self.assertFalse(alive)


if __name__ == "__main__":
 unittest.main()
