package com.smu.backend.mapper;

import com.smu.backend.dto.SensorLogDTO;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.util.List;

@Mapper
public interface SensorLogMapper {

    // 1. 서울시 공공데이터를 DB에 저장할 때 쓸 메서드
    void insertSensorLog(SensorLogDTO sensorLog);

    boolean existsLocation(Long id);
    void insertLocation(Long id, String name);
    // 2. 프론트엔드(지도)에 뿌려줄 최신 수위 데이터를 가져올 메서드
    SensorLogDTO getLatestLogByLocationId(Long locationId);

    List<SensorLogDTO> getLatestManholeData();

    List<SensorLogDTO> getLatestLogsForAllLocations();

    List<SensorLogDTO> getAllLocations();
    void updateLocationCoordinate(
            @Param("locationId") Long locationId,
            @Param("latitude") Double latitude,
            @Param("longitude") Double longitude
    );
}