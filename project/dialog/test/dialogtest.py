import pytest

from dialog.ontology import *
from dialog.semantic_serialization import deserialize


def run_dialog_test_nl(bot, resources, turns, session_data=None):
    state = bot.initiate_dialog_state(resources, session_data)
    for turn_content in turns:
        speaker, utterance = parse_turn_content(turn_content)
        handle_turn_nl(bot, speaker, utterance, resources, state)


def parse_turn_content(turn_content):
    speaker = turn_content[0]
    contribution = turn_content[2:]
    return speaker, contribution


def handle_turn_nl(bot, speaker, utterance, resources, state):
    if speaker == 'S':
        try:
            actual_utterance = bot.get_response(resources, state)
        except:
            pytest.fail(f'Exception raised when expecting system utterance {utterance!r}')
            raise
        expected_utterance = None if utterance == '' else utterance
        assert actual_utterance == expected_utterance
    elif speaker == 'U':
        state.user_input = UserInput(utterance=utterance)


def run_dialog_test_sem(bot, resources, turns, session_data=None):
    state = bot.initiate_dialog_state(resources, session_data)
    for turn_content in turns:
        speaker, move_representation = parse_turn_content(turn_content)
        handle_turn_sem(bot, speaker, move_representation, state)


def handle_turn_sem(bot, speaker, move_representation, state):
    if speaker == 'S':
        expected_system_move = None if move_representation == '' else deserialize(move_representation)
        try:
            actual_system_move = bot.get_system_move(state)
        except:
            pytest.fail(f'Exception raised when expecting system move {move_representation}')
            raise
        assert actual_system_move == expected_system_move
    elif speaker == 'U':
        move = deserialize(move_representation)
        state.user_input = UserInput(move=move)
