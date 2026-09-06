Docker is unavailable. Exact error:

```
--: line 4: docker: command not found
```

`docker compose version` wrote that to `.trial/env.txt`. `make smoke` then failed with:

```
docker compose --profile smoke up --build --abort-on-container-exit --exit-code-from playwright
make: docker: No such file or directory
make: *** [Makefile:21: smoke] Error 127
```

`/var/run/docker.sock` is absent. `which docker` / `command -v docker` found nothing. Protocol requires abort when Docker is unavailable or smoke is not 4 passed. Did not run the app or tests with the host Node toolchain.
