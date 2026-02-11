dev:
  npm run dev -- --port 6173

build:
  npm run build

deploy target: build
  rsync -av --delete --progress build/ {{target}}:~/yoink/
