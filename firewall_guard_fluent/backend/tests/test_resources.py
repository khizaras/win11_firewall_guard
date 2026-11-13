import os, unittest
from app.resources import block_reason, _parse_gpu_payload

class TerminationGuard(unittest.TestCase):
    def test_system_pid_is_blocked(self):
        self.assertIsNotNone(block_reason(4, "System"))

    def test_critical_name_is_blocked(self):
        self.assertIn("lsass.exe", block_reason(900, "lsass.exe"))

    def test_self_is_blocked(self):
        self.assertIsNotNone(block_reason(os.getpid(), "python.exe"))

    def test_ordinary_process_is_allowed(self):
        self.assertIsNone(block_reason(4242, "notepad.exe"))

class GpuParse(unittest.TestCase):
    def test_groups_adapter_and_process(self):
        payload = {"names": ["Test GPU"], "samples": [
            {"path": r"\\pc\gpu adapter memory(luid_0x1_0x2_phys_0)\dedicated usage", "instance": "luid_0x1_0x2_phys_0", "value": 5000},
            {"path": r"\\pc\gpu engine(pid_42_luid_0x1_0x2_phys_0_eng_0_engtype_3D)\utilization percentage", "instance": "pid_42_luid_0x1_0x2_phys_0_eng_0_engtype_3D", "value": 25},
            {"path": r"\\pc\gpu process memory(pid_42_luid_0x1_0x2_phys_0)\dedicated usage", "instance": "pid_42_luid_0x1_0x2_phys_0", "value": 4096},
        ]}
        parsed = _parse_gpu_payload(payload)
        self.assertEqual(parsed["adapters"][0]["memory_used_bytes"], 5000)
        self.assertEqual(parsed["adapters"][0]["usage_percent"], 25.0)
        self.assertEqual(parsed["apps"][0]["pid"], 42)
        self.assertEqual(parsed["apps"][0]["dedicated_bytes"], 4096)

if __name__ == "__main__":
    unittest.main()
