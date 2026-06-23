DIST := strata.zip

.PHONY: build zip clean

# Compile the React SPA → dist/ (index.html + hashed assets + api.php).
build:
	@npm run build

# Shareable bundle: the BUILT app only. Recipient needs PHP — no Node/npm.
#   unzip strata.zip -d strata && cd strata && php -S 127.0.0.1:8000
# then open http://127.0.0.1:8000/
zip: build
	@rm -f $(DIST)
	@cd dist && zip -rq ../$(DIST) . -x '*.DS_Store'
	@echo "Built $(DIST) — unzip, then: php -S 127.0.0.1:8000"

clean:
	@rm -f $(DIST)
	@rm -rf dist
