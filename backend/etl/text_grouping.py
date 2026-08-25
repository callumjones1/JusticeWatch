"""Lightweight, deterministic grouping for free-text category labels.

The source dataset's issueCategories field has no controlled vocabulary --
an event about 5G conspiracy protests might carry "5G", "5G conspiracy
claims", "5G infrastructure", "5G safety" etc. as separate strings. Rather
than a fuzzy-matching pass (the kind of heuristic that caused real
over-merging bugs when applied to whole events), category grouping only
needs a *safe* signal: group by the first significant word. This can under-
group (leave two genuinely-similar categories that start with different
words ungrouped) but never over-groups two unrelated topics together --
sharing a leading noun/adjective is a strong signal for a short topic
phrase, unlike sharing generic vocabulary across a whole event description.
"""

import re

_STOPWORDS = {
    "and", "or", "the", "of", "in", "on", "for", "to", "a", "an", "about",
    "related", "issues", "issue", "concerns", "concern", "claims", "claim",
    "activity", "activities", "matters", "matter", "regarding", "against",
}


def category_group_key(category: str) -> str:
    words = re.findall(r"[a-z0-9]+", category.lower())
    for w in words:
        if w not in _STOPWORDS:
            return w
    return category.strip().lower()
