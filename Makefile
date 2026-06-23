DIST := strata.zip
FILES := index.html api.php README.md assets/strata.js assets/strata.css assets/strata-logo.png

.PHONY: zip clean

zip:
	@rm -f $(DIST)
	@zip -r $(DIST) $(FILES) -x '*.DS_Store'
	@echo "Built $(DIST)"

clean:
	@rm -f $(DIST)
