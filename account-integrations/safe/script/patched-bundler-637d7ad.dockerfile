FROM accountabstraction/bundler:0.6.2

RUN apt-get update && \
    apt-get install -y coreutils && \
    rm -rf /var/lib/apt/lists/*

ARG EXPECTED_DIGEST="637d7ad92ac375fb72dcdd8c0385973e58cc80ec3e3b7b80794987e629602eb8"

# Check the SHA256 digest of /app/bundler.js and abort if not matched
RUN if [ "$(sha256sum /app/bundler.js | awk '{print $1}')" != "$EXPECTED_DIGEST" ]; then \
    echo "SHA256 digest does not match. Aborting."; \
    exit 1; \
fi

# Modify /app/bundler.js to add support for estimating (but not running) aggregate bundles
RUN sed -i 's/(errorResult.errorName !== '\''ValidationResult'\'')/(!errorResult.errorName.startsWith('\''ValidationResult'\''))/g' /app/bundler.js
