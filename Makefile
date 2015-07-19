all: clean build

build: build/index.js

clean: clean_js

clean_js:
	rm -rf build/*

build/index.js:
	mkdir -p build
	./node_modules/.bin/babel src --out-dir build
	touch example/example.js

example/build.js: build/index.js
	./node_modules/.bin/browserify example/example.js -t babelify > $@