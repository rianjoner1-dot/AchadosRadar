-- Price/media migration resets column grants; the search cursor also reads offer.id.
GRANT SELECT(id) ON public.offers TO anon,authenticated;
