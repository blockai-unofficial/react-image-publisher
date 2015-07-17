all: build

build: build/index.js

clean: clean_js

clean_js:
	rm -rf build/*
	rm -f example/build.js

build/index.js:
	mkdir -p build
	./node_modules/.bin/babel src --out-dir build

example/build.js: build/index.js
	./node_modules/.bin/browserify example/example.js -t babelify > $@