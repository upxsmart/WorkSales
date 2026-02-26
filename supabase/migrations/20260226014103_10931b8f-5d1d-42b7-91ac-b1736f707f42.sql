-- Create vault secret for encryption
SELECT vault.create_secret(
  encode(extensions.gen_random_bytes(32), 'hex'),
  'app_encryption_key',
  'Passphrase for encrypting sensitive fields'
);