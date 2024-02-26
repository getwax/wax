FROM accountabstraction/bundler:0.6.2

RUN apt-get update && \
    apt-get install -y coreutils && \
    rm -rf /var/lib/apt/lists/*

ARG EXPECTED_DIGEST="727838bd8705dd319970fb4a86c9abe5334e17312230143e01043abf0732b5f7"

# Modify /app/bundler.js to add support for estimating (but not running) aggregate bundles
RUN sed -i 's/(errorResult.errorName !== '\''ValidationResult'\'')/(!errorResult.errorName.startsWith('\''ValidationResult'\''))/g' /app/bundler.js

# Fail if we didn't achieve the expected SHA256 digest
RUN if [ "$(sha256sum /app/bundler.js | awk '{print $1}')" != "$EXPECTED_DIGEST" ]; then \
    echo "SHA256 digest does not match. Aborting."; \
    exit 1; \
fi
