from google.api_core.exceptions import NotFound
from src.repositories.users_repo import UserRepository


class UserService:
    
    @staticmethod
    async def get_or_create_profile(user_id: str, email: str, name: str, avatar_url: str | None) -> dict:
        """Called on first login. Creates profile + empty preferences if not exists."""
        profile = await UserRepository.get_profile(user_id)
        if profile is None:
            profile = await UserRepository.create_profile(user_id, {
                "email": email,
                "name": name,
                "avatar_url": avatar_url,
                "onboarded": False,
            })
        
        pref = await UserRepository.get_preferences(user_id)
        if pref is None:
            await UserRepository.create_preferences(user_id, {
                "research_interests": [],
                "target_countries": [],
                "target_universities": [],
                "degree_type": "Either",
                "funding_required": False,
            })
            
        return profile

    @staticmethod
    async def get_profile(user_id: str) -> dict:
        """Get current user profile. Raises ValueError if not found."""
        profile = await UserRepository.get_profile(user_id)
        if profile is None:
            raise ValueError("User profile not found")
        return profile

    @staticmethod
    async def update_profile(user_id: str, data: dict) -> dict:
        """Update profile fields."""
        try:
            return await UserRepository.update_profile(user_id, data)
        except NotFound as e:
            raise ValueError("User profile not found") from e

    @staticmethod
    async def get_preferences(user_id: str) -> dict | None:
        """Get preferences."""
        return await UserRepository.get_preferences(user_id)

    @staticmethod
    async def upsert_preferences(user_id: str, data: dict) -> dict:
        """Full replace or update of preferences document."""
        pref = await UserRepository.get_preferences(user_id)
        if pref is None:
            return await UserRepository.create_preferences(user_id, data)
        try:
            return await UserRepository.update_preferences(user_id, data)
        except NotFound as e:
            raise ValueError("Preferences not found") from e

    @staticmethod
    async def update_preferences(user_id: str, data: dict) -> dict:
        """Partial update for user preferences.

        List fields (research_interests, target_countries, target_universities) are
        fully replaced when present in *data*. Scalar fields (degree_type,
        funding_required) are patched individually. Keys absent from *data* are
        left unchanged.
        """
        # Remap tool-facing field names to the stored Firestore field names.
        field_map = {
            "research_interests": "research_interests",
            "countries": "target_countries",
            "universities": "target_universities",
            "degree_type": "degree_type",
            "funding_required": "funding_required",
        }
        patch: dict = {}
        for tool_key, db_key in field_map.items():
            if tool_key in data and data[tool_key] is not None:
                patch[db_key] = data[tool_key]

        if not patch:
            # Nothing to update – return current preferences unchanged.
            return await UserRepository.get_preferences(user_id) or {}

        try:
            await UserRepository.update_preferences(user_id, patch)
        except NotFound as e:
            raise ValueError("Preferences not found") from e

        return await UserRepository.get_preferences(user_id) or {}

    @staticmethod
    async def append_research_interest(user_id: str, interest: str) -> dict:
        """Append one interest and return updated preferences."""
        try:
            await UserRepository.append_research_interest(user_id, interest)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_research_interest(user_id: str, interest: str) -> dict:
        """Remove one interest and return updated preferences."""
        try:
            await UserRepository.remove_research_interest(user_id, interest)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def append_target_country(user_id: str, country: str) -> dict:
        """Append one country and return updated preferences."""
        try:
            await UserRepository.append_target_country(user_id, country)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_target_country(user_id: str, country: str) -> dict:
        """Remove one country and return updated preferences."""
        try:
            await UserRepository.remove_target_country(user_id, country)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def append_target_university(user_id: str, university: str) -> dict:
        """Append one university and return updated preferences."""
        try:
            await UserRepository.append_target_university(user_id, university)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_target_university(user_id: str, university: str) -> dict:
        """Remove one university and return updated preferences."""
        try:
            await UserRepository.remove_target_university(user_id, university)
        except NotFound as e:
            raise ValueError("Preferences not found") from e
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}
