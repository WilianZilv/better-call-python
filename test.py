number = 0


def sum_number(amount=1, outro):
    global number
    number += amount


args = []
sum_number(*args)
args = [2]
sum_number(*args)

print(number)
