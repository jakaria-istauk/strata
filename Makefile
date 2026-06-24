DIST := strata.zip
WP_DIST := strata-wp.zip
WP_STAGE := .wp-pkg

.PHONY: build zip wp-zip clean

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

# WordPress plugin zip. Builds the SPA bundle, then stages the plugin under a
# `strata/` root so it unzips/installs as wp-content/plugins/strata (not
# strata-wp). Install via Plugins → Add New → Upload Plugin. Needs only WP.
wp-zip:
	@npm run build:wp
	@rm -rf $(WP_STAGE) $(WP_DIST)
	@mkdir -p $(WP_STAGE)/strata
	@cp -R strata-wp/strata.php strata-wp/admin.css strata-wp/includes strata-wp/build $(WP_STAGE)/strata/
	@cd $(WP_STAGE) && zip -rq ../$(WP_DIST) strata -x '*.DS_Store'
	@rm -rf $(WP_STAGE)
	@echo "Built $(WP_DIST) — Plugins → Add New → Upload Plugin (installs as plugins/strata)"

clean:
	@rm -f $(DIST) $(WP_DIST)
	@rm -rf dist $(WP_STAGE)
