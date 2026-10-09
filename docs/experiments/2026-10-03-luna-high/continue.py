"""Explicit supplemental turns; never overwrite primary results."""
import concurrent.futures, json
from run import ROOT, run_phase

def continue_case(case_id, phase):
    case = ROOT / 'cases' / case_id
    if (case / f'result-{phase}.json').exists():
        raise RuntimeError('Refusing overwrite')
    first = json.loads((case / 'result-A.json').read_text())
    return run_phase(case, phase, first['threadId'])

if __name__ == '__main__':
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        futures = [pool.submit(continue_case, '04', 'B'), pool.submit(continue_case, '05', 'C'), pool.submit(continue_case, '10', 'B')]
        for future in futures:
            future.result()
