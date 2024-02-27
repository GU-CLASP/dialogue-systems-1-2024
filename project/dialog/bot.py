from dialog.ontology import DialogState
from dialog import dm
from dialog.logger import logger


def initiate_dialog_state(resources, session_data):
    state = DialogState()
    state.user_input = None
    state.domain = resources['domain_class'](resources, session_data)
    state.private.plan = state.domain.initial_plan()
    return state


def get_response(resources, state):
    if state.user_input and state.user_input.move is None:
        state.user_input.move = resources['nlu'].interpret(state.user_input.utterance)
        logger.info('interpretation', move=state.user_input.move)
    system_move = get_system_move(state)
    return None if system_move is None else resources['nlg'].generate(system_move)


def get_system_move(state):
    logger.info('bot.get_system_move', state=state)
    state.next_system_move = None
    dm.update_and_select(state)
    system_move = state.next_system_move
    logger.info('system_move', move=system_move)
    if system_move is not None:
        state.previous_system_move = system_move
    return system_move
