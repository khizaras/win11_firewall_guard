# Policy file

Edit `backend/config/policies.json`. Example selector:
```json
{"id":"block-updater","name":"Block updater","enabled":false,"automatic":true,"action":"block","direction":"outbound","process_name_patterns":["*untrusted-updater*"],"service_name_patterns":[],"program_paths":[],"remote_ips":[],"remote_ports":[],"protocol":"Any"}
```
Keep policies disabled and dry-run enabled during validation. This scaffold shows policy configuration; it does not run a persistent automatic enforcement worker.
