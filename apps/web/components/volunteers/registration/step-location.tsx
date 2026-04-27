'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LocationMapPicker } from '@/components/needs/location-map-picker'
import { MapPin } from 'lucide-react'

interface LocationData {
  lat: number
  lng: number
  address: string
  max_travel_km: number
}

interface StepLocationProps {
  value: Partial<LocationData>
  onChange: (data: Partial<LocationData>) => void
}

export function StepLocation({ value, onChange }: StepLocationProps) {
  const pin =
    value.lat != null && value.lng != null
      ? { lat: value.lat, lng: value.lng }
      : null

  const handlePinChange = (coords: { lat: number; lng: number }) => {
    onChange({ ...value, lat: coords.lat, lng: coords.lng })
  }

  const handleAddressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({ ...value, address: e.target.value })
  }

  const handleMaxTravelChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const km = parseInt(e.target.value, 10)
    if (!isNaN(km)) onChange({ ...value, max_travel_km: km })
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-zinc-900">Your Location</h2>
        <p className="mt-1 text-sm text-zinc-500">
          We use this to match you with needs near you. Drag the pin to your
          home or base location.
        </p>
      </div>

      {/* Address text */}
      <div className="space-y-1.5">
        <Label htmlFor="home_address" className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-zinc-500" />
          Home / Base Address
        </Label>
        <Input
          id="home_address"
          placeholder="e.g. Sector 21, Gandhinagar, Gujarat"
          value={value.address ?? ''}
          onChange={handleAddressChange}
        />
      </div>

      {/* Map */}
      <LocationMapPicker
        value={pin}
        onChange={handlePinChange}
        className="h-72 w-full"
      />

      {!pin && (
        <p className="text-xs text-amber-600">
          Click the map to set your location — this is required for matching.
        </p>
      )}

      {/* Max travel distance */}
      <div className="space-y-1.5">
        <Label htmlFor="max_travel_km">
          Maximum travel distance:{' '}
          <span className="font-semibold text-zinc-900">
            {value.max_travel_km ?? 20} km
          </span>
        </Label>
        <input
          id="max_travel_km"
          type="range"
          min={1}
          max={200}
          step={5}
          value={value.max_travel_km ?? 20}
          onChange={handleMaxTravelChange}
          className="w-full accent-emerald-600"
        />
        <div className="flex justify-between text-xs text-zinc-400">
          <span>1 km</span>
          <span>200 km</span>
        </div>
      </div>
    </div>
  )
}