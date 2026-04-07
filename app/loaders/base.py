from abc import ABC, abstractmethod

from app.models import Document


class BaseLoader(ABC):
    @abstractmethod
    def load(self, path_or_url: str) -> list[Document]:
        """Parse source and return list of Document objects."""
        ...
