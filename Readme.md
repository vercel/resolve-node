# resolve-node.now.sh

API endpoint to resolve an arbitrary Node.js version with semver support.
Useful for shell scripting.

```
# Resolves the latest Node.js version by default
$ curl https://resolve-node.now.sh
v11.0.0

# The special `lts` path resolves latest Long Term Support version
$ curl https://resolve-node.now.sh/lts
v10.13.0

# Semver is also supported
$ curl https://resolve-node.now.sh/8.x
v8.12.0
```
