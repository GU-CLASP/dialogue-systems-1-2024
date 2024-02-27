import pytest

import dialog.music_personality.ontology
from dialog.music_personality.ontology import *
from dialog import semantic_serialization


semantic_serialization.register_module(dialog.music_personality.ontology)


instances = [
    (
        "Extraverted()",
        Extraverted()
    ),
    (
        "Not(Extraverted())",
        Not(Extraverted())),
    (
        "Assert(Not(HighValue(danceability_mean)))",
        Assert(Not(HighValue(danceability_mean)))
    ),
    (
        "Ask(Why(Explains(Not(HighValue(danceability_mean)), Not(Extraverted()))))",
        Ask(Why(Explains(Not(HighValue(danceability_mean)), Not(Extraverted()))))
    ),
    (
        "Ask(Why(HighValue(danceability_mean)))",
        Ask(Why(HighValue(danceability_mean)))
    ),
    (
        "Ask(Why(Not(HighValue(danceability_mean))))",
        Ask(Why(Not(HighValue(danceability_mean))))
    ),
    (
        "None",
        None
    )
]


class TestSemanticSerialization:
    @pytest.mark.parametrize('string,object', instances)
    def test_deserialize(self, string, object):
        actual = semantic_serialization.deserialize(string)
        assert actual == object
