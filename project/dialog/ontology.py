from __future__ import annotations
from typing import TypeVar
from dataclasses import dataclass, field


SemanticType = TypeVar('SemanticClass')


class SemanticClass:
    pass


@dataclass
class Move(SemanticClass):
    pass


@dataclass
class Proposition(SemanticClass):
    pass


@dataclass
class Not(Proposition):
    content: Proposition


@dataclass
class Supports(Proposition):
    antecedent: Proposition
    consequent: Proposition


@dataclass
class Explains(Proposition):
    explanans: Proposition
    explanandum: Proposition


@dataclass
class LackKnowledge(Proposition):
    pass


def Sort(name):
    return TypeVar(name, bound=SemanticType)


def Individual(name, sort):
    return TypeVar(name, bound=sort)


ICMLevel = Sort('ICMLevel')
understanding = Individual('understanding', ICMLevel)
acceptance = Individual('acceptance', ICMLevel)


Polarity = Sort('Polarity')
positive = Individual('positive', Polarity)
negative = Individual('negative', Polarity)


@dataclass
class ICM(Move):
    level: ICMLevel
    polarity: Polarity
    reason: Proposition = None


Hedge = Sort('Hedge')
strong = Individual('strong', Hedge)
medium = Individual('medium', Hedge)
weak = Individual('weak', Hedge)


@dataclass
class Assert(Move):
    proposition: Proposition
    hedge: Hedge = None


@dataclass
class Belief:
    proposition: Proposition
    confidence: int = None


@dataclass
class Question(SemanticClass):
    pass


@dataclass
class BooleanQuestion(Question):
    proposition: Proposition


@dataclass
class Why(Question):
    explanandum: Proposition = None


@dataclass
class WhQuestion(Question):
    predicate: SemanticClass


@dataclass
class Ask(Move):
    question: Question


@dataclass
class UserInput:
    utterance: str = None
    move: Move = None


@dataclass
class PlanItem:
    pass


@dataclass
class Respond(PlanItem):
    question: Question


@dataclass
class Private:
    plan: list[PlanItem] = field(default_factory=list)
    beliefs: list[Belief] = field(default_factory=list)
    non_integrated_moves: list[Move] = field(default_factory=list)


@dataclass
class Shared:
    latest_moves: list[Move] = field(default_factory=list)
    qud: list[Question] = field(default_factory=list)


@dataclass
class DialogState:
    private: Private = field(default_factory=Private)
    shared: Shared = field(default_factory=Shared)
    user_input: UserInput = None
    previous_system_move: Move = None
    next_system_move: Move = None
    domain = None
