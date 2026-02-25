
"use client";

import { useState, useEffect } from "react";

interface AreaSelectorProps {
    prefCode: string;
    onCitySelect: (city: string) => void;
    onReset: () => void;
}

export function AreaSelector({ prefCode, onCitySelect, onReset }: AreaSelectorProps) {
    const [cities, setCities] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!prefCode) return;

        const fetchCities = async () => {
            setLoading(true);
            setError("");
            try {
                const res = await fetch(`/api/cities?pref=${prefCode}`);
                if (!res.ok) throw new Error("Failed to load cities");
                const json = await res.json();
                setCities(json.cities || []);
            } catch (e: any) {
                setError(e.message);
            } finally {
                setLoading(false);
            }
        };
        fetchCities();
    }, [prefCode]);

    if (loading) return <div className="text-gray-500 p-4 text-center anim-pulse">エリア情報を分析中...</div>;
    if (error) return <div className="text-red-500 p-4">エラー: {error}</div>;

    return (
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
            <h3 className="text-sm font-bold text-gray-700 mb-2">エリアを選択してください（取引件数順に駅を表示します）</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-60 overflow-y-auto">
                {cities.map((city) => (
                    <button
                        key={city}
                        onClick={() => onCitySelect(city)}
                        className="text-left px-3 py-2 text-sm text-gray-700 hover:bg-[#b94047] hover:text-white rounded transition-colors"
                    >
                        {city}
                    </button>
                ))}
            </div>
            <button onClick={onReset} className="mt-4 text-xs text-blue-500 hover:underline">
                全駅リストを表示（従来モード）
            </button>
        </div>
    );
}
