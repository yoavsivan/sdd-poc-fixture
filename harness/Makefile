# Operator entrypoints. Recipes are one-line calls into run/ and score/.
# Variables: ARM (conductor|gatekit|spec-kit), N, HELD_OUT, RUN_DIR.

ARM ?=
N ?=
HELD_OUT ?= ../evidence/held-out/harness
RUN_DIR ?= ../evidence
PY := python3
export HARNESS_RUN_DIR := $(RUN_DIR)
export HARNESS_HELD_OUT := $(HELD_OUT)
# Scripts are invoked as `python3 run/foo.py`; modules import `from run.common`.
export PYTHONPATH := $(CURDIR)

.PHONY: test test-preflight register register-v2 verify-registration freeze-check \
	preflight-docker dry-run trial trial2 tiebreak indistinguishable reshape \
	score scorecard branch triptych card excerpts example-e2 example-e3 \
	exhibit publish-prep clean-builds

test:
	$(PY) -m unittest discover -t . -s run/tests
	$(PY) -m unittest discover -t . -s score/tests

test-preflight:
	HARNESS_SCORE_DIR=score $(PY) -m unittest discover -t $(HELD_OUT)/score -s $(HELD_OUT)/score -p 'test_spec_coverage.py'

register:
	$(PY) run/register.py --v1

register-v2:
	$(PY) run/register.py --v2

verify-registration:
	$(PY) run/register.py --verify-local --verify-public

freeze-check:
	$(PY) run/freeze_check.py

preflight-docker:
	$(PY) run/spawn.py --probe

dry-run:
	$(PY) run/trial.py --all --n 1

trial:
	$(PY) run/trial.py --arm $(ARM) --n $(N)

trial2:
	$(PY) run/trial.py --all --n 2

tiebreak:
	$(PY) score/decide.py tiebreak
	$(PY) run/trial.py --tiebreak

indistinguishable:
	$(PY) score/decide.py indistinguishable

reshape:
	$(PY) run/reshape.py

score:
	$(PY) score/spec_coverage.py --repo $(RUN_DIR)/build/$(ARM)-$(N)-done-f1 --base $$(python3 -c 'import json; print(json.load(open("config.json"))["fixture"]["sha"])') --tag $$(python3 -c 'import json; print(json.load(open("$(RUN_DIR)/trials/$(ARM)/$(N)/tags.json"))["done-f1"])') --arm $(ARM) --rubric score/RUBRIC.md --json
	$(PY) score/spec_coverage.py --repo $(RUN_DIR)/build/$(ARM)-$(N)-done-f1p --base $$(python3 -c 'import json; print(json.load(open("config.json"))["fixture"]["sha"])') --tag $$(python3 -c 'import json; print(json.load(open("$(RUN_DIR)/trials/$(ARM)/$(N)/tags.json")).get("done-f1p") or "")') --arm $(ARM) --rubric score/RUBRIC.md --json
	$(PY) score/decisions.py --transcript $(RUN_DIR)/trials/$(ARM)/$(N)/transcript.json --self $(RUN_DIR)/trials/$(ARM)/$(N)/decisions.jsonl --json
	$(PY) score/stale/collect.py --trial $(RUN_DIR)/trials/$(ARM)/$(N)

scorecard:
	$(PY) score/scorecard.py table --evidence $(RUN_DIR) --out $(RUN_DIR)/trials
	$(PY) score/scorecard.py ledger --evidence $(RUN_DIR) --out $(RUN_DIR)/trials
	$(PY) score/scorecard.py invalid --evidence $(RUN_DIR) --out $(RUN_DIR)/trials
	$(PY) score/scorecard.py caveats --evidence $(RUN_DIR) --out $(RUN_DIR)/trials

branch:
	$(PY) score/decide.py branch --evidence $(RUN_DIR)

triptych:
	$(PY) score/scorecard.py triptych --evidence $(RUN_DIR) --out $(RUN_DIR)/trials

card:
	$(PY) score/card.py --csv $(RUN_DIR)/trials/scorecard.csv --out $(RUN_DIR)/trials --png
	$(PY) score/card.py --csv $(RUN_DIR)/trials/scorecard.csv --out $(RUN_DIR)/trials --png --highlight decisions

excerpts:
	$(PY) run/excerpts.py --arm $(ARM) --n $(N)

example-e2:
	$(PY) run/excerpts.py --select gatekit-done --arm gatekit --n 1

example-e3:
	$(PY) run/excerpts.py --select decision --most-stops

exhibit:
	$(PY) run/trial.py --exhibit

publish-prep:
	$(PY) run/publish_prep.py --verify

clean-builds:
	rm -rf $(RUN_DIR)/build
	-for p in conductor gatekit spec-kit; do for n in 1 2 3; do for t in done-f1 done-f1p; do docker compose -p harness-$$p-$$n-$$t down -v; done; done; done
