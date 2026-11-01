// Setup test environment variables before tests execute
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
  process.env.DATABASE_URL ||
  "Server=localhost,1433;Database=assessdb_test;User ID=sa;Password=Dev!Pass123;Encrypt=false;TrustServerCertificate=true;";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET || "test-session-secret-at-least-32-chars-long";
process.env.PLATFORM_KEY =
  process.env.PLATFORM_KEY || "test-platform-key-at-least-32-chars-long";
process.env.BLOB_CONNECTION_STRING =
  process.env.BLOB_CONNECTION_STRING ||
  "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=dev_placeholder_account_key;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;";
process.env.APP_BASE_URL = process.env.APP_BASE_URL || "http://localhost:8080";
process.env.API_INTERNAL_URL = process.env.API_INTERNAL_URL || "http://localhost:8080";
process.env.GIT_SHA = process.env.GIT_SHA || "test-sha";
