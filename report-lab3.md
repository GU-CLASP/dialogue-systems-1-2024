# Unrecognized entities
When I tried the utterance "Does listening to ARTIST affect anything?") then the artist is sometimes misrecognized. Here are some misrecognitions that I encountered:

- Ellegarden (recognized as Elgarden)
- Dir En Grey (recognized as Dear and Grey)
- Hopsin (recognized as hop scene)

In all cases, the confidence was around 0.7.

# After tuning
After training with text data (see ArtistsSpeechData.txt) with the same utterance template as above I get the following results:

- Ellegarden misrecognized as Ellgarden
- Dir En Grey misrecognized as deer and grey
- Hopsin recognized correctly

Endpoint ID: d22bcb56-83bd-4686-848d-af1c8ecc02c3
