from dialog.ontology import *


def is_elliptical_question(question):
    return isinstance(question, Why) and question.explanandum is None


def negate_proposition(proposition):
    if isinstance(proposition, Not):
        return proposition.content
    else:
        return Not(proposition)
