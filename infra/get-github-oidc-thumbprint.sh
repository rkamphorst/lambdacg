
#!/bin/bash

echo | \
    openssl s_client -showcerts -connect token.actions.githubusercontent.com:443 2>/dev/null | \
    tail -r | \
    awk '/-----END CERTIFICATE-----/{f=1} f; /-----BEGIN CERTIFICATE-----/{exit}' | \
    tail -r | \
    openssl x509 -fingerprint -noout | \
    sed -E 's/SHA1 Fingerprint=(.*)/\1/' | \
    sed -E 's/://g'