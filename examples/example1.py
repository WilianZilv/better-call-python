number = 0


def sum_number(amount=1):
    global number
    number += amount
    if(number >= 100):
        emit('bigNumber', number, 'number got big')
