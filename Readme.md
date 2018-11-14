# resolve-node.now.sh

API endpoint to resolve an arbitrary Node.js version with semver support.
Useful for shell scripting.

```
# Resolves the latest Node.js version by default
$ curl https://resolve-node.now.sh
v11.0.0

# The special `lts` path resolves latest Long Term Support (LTS) version
$ curl https://resolve-node.now.sh/lts
v10.13.0

# LTS version resolution by code name via `lts/:codename` is also supported
$ curl https://resolve-node.now.sh/lts/carbon
v8.12.0

# Semver is also supported
$ curl https://resolve-node.now.sh/8.x
v8.12.0
```
