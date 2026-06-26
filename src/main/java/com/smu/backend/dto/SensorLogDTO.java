package com.smu.backend.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data // 이 어노테이션 하나면 Getter, Setter가 자동으로 다 만들어짐
public class SensorLogDTO {
    private Long id;                // BIGINT (PK)
    private Long locationId;        // BIGINT (FK)
    private Integer waterLevel;     // INT (수위)
    private Float temperature;      // FLOAT (온도)
    private Float humidity;         // FLOAT (습도)
    private LocalDateTime measuredAt; // TIMESTAMP (측정 시간)

    // 🌟 프론트엔드 맵에 뿌려주기 위해 locations 테이블에서 조인해 올 필드들 추가!
    private String name;        // 맨홀 이름(주소/위치 설명)
    private Double latitude;    // 위도
    private Double longitude;   // 경도
}