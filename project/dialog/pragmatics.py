from dialog.ontology import *
from dialog.semantics import negate_proposition


def is_compatible_with_beliefs(proposition, beliefs, domain):
    for belief in beliefs:
        if belief.proposition == proposition:
            return True
    if isinstance(proposition, Explains):
        supporting_propositions = list(domain.get_support(proposition.explanandum))
        return proposition.explanans in supporting_propositions


def resolve_elliptical_question(question, state):
    if isinstance(question, Why) and isinstance(state.previous_system_move, Assert):
        return Why(state.previous_system_move.proposition)


def get_answer(question, beliefs, domain):
    answer_from_domain = domain.get_answer(question)
    if answer_from_domain:
        return answer_from_domain
    if isinstance(question, Why):
        return select_explanation(question.explanandum, beliefs, domain)
    if isinstance(question, BooleanQuestion):
        if isinstance(question.proposition, Supports):
            for supporting_proposition in domain.get_support(question.proposition.consequent):
                if question.proposition.antecedent == supporting_proposition:
                    return Belief(question.proposition)
            return Belief(negate_proposition(question.proposition))


def is_relevant_answer(question, proposition, domain):
    if isinstance(proposition, Not):
        return is_relevant_answer(question, proposition.content, domain)
    if isinstance(question, BooleanQuestion):
        if isinstance(question.proposition, Supports):
            return proposition == question.proposition or Not(question.proposition) == proposition
    if isinstance(question, WhQuestion):
        return isinstance(proposition, question.predicate)
    return domain.is_relevant_answer(question, proposition)


def select_explanation(explanandum, beliefs, domain):
    enthymematic_explanans = get_enthymematic_explanans(explanandum, beliefs, domain)
    if enthymematic_explanans:
        return enthymematic_explanans
    topos = get_topos(explanandum, domain)
    if topos:
        return topos


def get_enthymematic_explanans(explanandum, beliefs, domain):
    supporting_propositions = list(domain.get_support(explanandum))
    if len(supporting_propositions) > 0:
        return Belief(supporting_propositions[0])


def get_topos(explanandum, domain):
    if isinstance(explanandum, Explains):
        supporting_propositions = list(domain.get_support(explanandum.explanandum))
        if len(supporting_propositions) > 0:
            return Belief(Supports(supporting_propositions[0], explanandum.explanandum))


def select_answer_move(belief, state):
    hedge = confidence_to_hedge_level(belief.confidence)
    for move in state.shared.latest_moves:
        if isinstance(move, Ask):
            if isinstance(move.question, BooleanQuestion):
                if is_relevant_answer(move.question, belief.proposition, state.domain):
                    if move.question.proposition == belief.proposition:
                        return Assert(True, hedge)
                    else:
                        return Assert(False, hedge)
    return Assert(belief.proposition, hedge)


def confidence_to_hedge_level(confidence):
    if confidence is None:
        return None
    elif confidence >= 0.9:
        return strong
    elif confidence >= 0.1:
        return medium
    else:
        return weak
