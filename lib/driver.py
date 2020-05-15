import json
import sys


def emit(channel, *args):
    try:
        message = {"channel": channel, "args": args}
    except Exception as e:
        message = {"channel": channel, "error": str(e)}

    sys.stderr.write(json.dumps(message) + '\n')
    sys.stderr.flush()


def _____pprint_____(*args):
    emit('print', *args)


print = _____pprint_____
''''''
while True:
    try:
        line = sys.stdin.readline()
        data = json.loads(line)
    except:
        continue
    response = {}
    path = data['path']
    args = data['args']

    try:
        typeof = str(type(eval(path)))
        if 'function' in typeof:
            path += '(**args)' if 'dict' in str(type(args)) else '(*args)'

        exec('value='+path)

        if 'ndarray' in str(type(value)):
            value = {"data": value.tolist(), "type": "numpy.ndarray"}

        response['data'] = value
    except Exception as e:
        response["error"] = str(e)

    sys.stdin.flush()
    sys.stdout.write(json.dumps(response) + '\n')
    sys.stdout.flush()
