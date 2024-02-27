from builtins import property

from dialog.music_personality.ontology import *
from dialog.music_personality.nl import feature_value_forms, feature_np


extraversion_adjective = {
    False: 'introverted',
    True: 'extraverted',
}


def generate(move):
    if isinstance(move, Assert):
        return generate_assert_move(move.proposition, move.hedge)
    if isinstance(move, ICM):
        return generate_icm(move)
    raise Exception(f'Failed to generate move {move}')


def generate_assert_move(proposition, hedge):
    if proposition in [True, False]:
        return generate_boolean_assertion(proposition, hedge)
    if proposition in [Extraverted(), Not(Extraverted())]:
        return generate_extraversion_assertion(proposition, hedge)
    if isinstance(proposition, HighValue) or (
            isinstance(proposition, Not) and isinstance(proposition.content, HighValue)):
        return f"The person likes {generate_feature_value_judgement(proposition)}."
    if isinstance(proposition, HigherThanAverage) or (
            isinstance(proposition, Not) and isinstance(proposition.content, HigherThanAverage)):
        return generate_higher_than_average(proposition)
    if isinstance(proposition, Supports):
        return generate_supports(proposition)
    if isinstance(proposition, Not) and isinstance(proposition.content, Supports):
        return generate_not_supports(proposition.content)
    if proposition == FactorsConsidered(audio_features):
        return f'I consider music heard by the person in terms of the following audio features: {generate_feature_np_conjunction()}.'
    raise Exception(f'Failed to generate assert move with proposition {proposition}')


def generate_boolean_assertion(positive, hedge):
    def generate_yes_or_no():
        return 'Yes' if positive else 'No'

    def generate_hedge():
        if hedge == strong:
            return "I'm quite confident about that"
        elif hedge == medium:
            return f"I think so" if positive else "I don't think so"
        elif hedge == weak:
            return "but I'm very uncertain"

    if hedge is None:
        return f'{generate_yes_or_no()}.'
    else:
        return f'{generate_yes_or_no()}, {generate_hedge()}.'


def generate_extraversion_assertion(proposition, hedge):
    adjective = generate_extraversion_adjective(proposition)
    if hedge == strong:
        return f"I'm quite confident that this person is {adjective}."
    elif hedge == medium:
        return f"I think this person is {adjective}."
    elif hedge == weak:
        return f"If I had to guess, I'd say that this person is {adjective}."


def generate_extraversion_adjective(proposition):
    positive = not isinstance(proposition, Not)
    return extraversion_adjective[positive]


def generate_feature_value_judgement(proposition):
    if isinstance(proposition, Not):
        positive = False
        feature_name = proposition.content.feature.__name__
    else:
        positive = True
        feature_name = proposition.feature.__name__
    return feature_value_forms[feature_name][positive]


def generate_supports(proposition):
    return f"Generally, listening to {generate_feature_value_judgement(proposition.antecedent)} correlates with being {generate_extraversion_adjective(proposition.consequent)}."


def generate_not_explains(proposition):
    return f"No, listening to {generate_feature_value_judgement(proposition.explanans)} does not correlate with being {generate_extraversion_adjective(proposition.explanandum)}."


def generate_not_supports(proposition):
    return f"No, listening to {generate_feature_value_judgement(proposition.antecedent)} does not correlate with being {generate_extraversion_adjective(proposition.consequent)}."


def generate_higher_than_average(proposition):
    if isinstance(proposition, HigherThanAverage):
        return f'Music heard by the person has a higher average score for {feature_np[proposition.feature.__name__]} than music in general.'
    elif isinstance(proposition, Not) and isinstance(proposition.content, HigherThanAverage):
        return f'Music heard by the person has a lower average score for {feature_np[proposition.content.feature.__name__]} than music in general.'



def generate_icm(move):
    if move.level == acceptance:
        if move.polarity == positive:
            return 'OK.'
        if move.polarity == negative:
            return generate_negative_acceptance(move.reason)
    if move.level == understanding and move.polarity == negative:
        return "Sorry, I don't understand."
    raise Exception(f'Failed to generate ICM move {move}')


def generate_negative_acceptance(reason):
    if isinstance(reason, LackKnowledge):
        return "I don't know."
    if reason in [Extraverted(), Not(Extraverted())]:
        return f"I don't think this person is {generate_extraversion_adjective(reason)}."
    if isinstance(reason, HighValue) or (isinstance(reason, Not) and isinstance(reason.content, HighValue)):
        return f"No, I don't think this person likes {generate_feature_value_judgement(reason)}."
    if isinstance(reason, Explains):
        return generate_not_explains(reason)


def generate_feature_np_conjunction():
    return generate_conjunction(list(feature_np.values()))


def generate_conjunction(terms):
    if len(terms) == 1:
        return terms[0]
    elif len(terms) == 2:
        return f'{terms[0]} and {terms[1]}'
    elif len(terms) > 1:
        return f'{terms[0]}, {generate_conjunction(terms[1:])}'
