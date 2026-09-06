Docker is unavailable; smoke did not run.

`docker compose version` failed with:
```
--: line 4: docker: command not found
exit:127
```

`make smoke` failed with:
```
docker compose --profile smoke up --build --abort-on-container-exit --exit-code-from playwright
make: docker: No such file or directory
make: *** [Makefile:21: smoke] Error 127
exit:2
```

`which docker` / `command -v docker` found nothing. `/var/run/docker.sock` is absent. Host is Ubuntu 24.04.4 LTS; no docker or docker-compose binary on PATH.

Protocol: if Docker is unavailable or the smoke is not `4 passed`, write this file, commit, push, and end. Did not run the app or any test with the host Node toolchain.
