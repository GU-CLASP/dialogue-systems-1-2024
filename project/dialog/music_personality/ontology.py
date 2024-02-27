from dataclasses import dataclass

from dialog.ontology import *


AudioFeature = Sort('AudioFeature')
energy_mean = Individual('energy_mean', AudioFeature)
mode_0_percentage = Individual('mode_0_percentage', AudioFeature)
loudness_mean = Individual('loudness_mean', AudioFeature)
speechiness_mean = Individual('speechiness_mean', AudioFeature)
instrumentalness_mean = Individual('instrumentalness_mean', AudioFeature)
valence_mean = Individual('valence_mean', AudioFeature)
danceability_mean = Individual('danceability_mean', AudioFeature)


class Extraverted(Proposition):
    pass


@dataclass
class HighValue(Proposition):
    feature: AudioFeature


@dataclass
class HigherThanAverage(Proposition):
    feature: AudioFeature



Factors = Sort('Factors')
audio_features = Individual('audio_features', Factors)


@dataclass
class FactorsConsidered(Proposition):
    factors: Factors
