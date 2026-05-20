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
        return await UserRepository.update_profile(user_id, data)

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
        return await UserRepository.update_preferences(user_id, data)

    @staticmethod
    async def append_research_interest(user_id: str, interest: str) -> dict:
        """Append one interest and return updated preferences."""
        await UserRepository.append_research_interest(user_id, interest)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_research_interest(user_id: str, interest: str) -> dict:
        """Remove one interest and return updated preferences."""
        await UserRepository.remove_research_interest(user_id, interest)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def append_target_country(user_id: str, country: str) -> dict:
        """Append one country and return updated preferences."""
        await UserRepository.append_target_country(user_id, country)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_target_country(user_id: str, country: str) -> dict:
        """Remove one country and return updated preferences."""
        await UserRepository.remove_target_country(user_id, country)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def append_target_university(user_id: str, university: str) -> dict:
        """Append one university and return updated preferences."""
        await UserRepository.append_target_university(user_id, university)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}

    @staticmethod
    async def remove_target_university(user_id: str, university: str) -> dict:
        """Remove one university and return updated preferences."""
        await UserRepository.remove_target_university(user_id, university)
        pref = await UserRepository.get_preferences(user_id)
        return pref or {}
